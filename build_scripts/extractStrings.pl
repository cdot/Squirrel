# Analyse .js files and extract the strings passed to TX.tx() calls
# Write result to STDOUT
use strict;
use JSON;

my $Q = qr/["']/;
my $C = qr/[-:\w ]*/;

my %strings;
$/ = undef;

sub sadd {
    my ($s, $i) = @_;
    $s =~ s/\s+/ /g;
    $s =~ s/$Q + $Q/ /g;
    $s =~ s/\s+/ /g;
    $s =~ s/^\s+//;
    $s =~ s/\s+^//;
    return $i if $strings{$s};
    $strings{$s} = 1;
    return $i;
}

while (@ARGV) {
    my $f = shift @ARGV;
    open(F, "<", $f) || die "Cannot open $f for read";
    print STDERR "Reading $f\n";
    $f = <F>;
    close(F);

    $f =~ s/(\bTX\.tx\(($Q)(.+?)\2)/sadd($3,$1)/ges;
}

my $json = new JSON;
my $data = [sort keys %strings];
print $json->utf8->encode($data);

1;
