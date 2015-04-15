#!/usr/bin/perl
# Extract strings for translation from sources
# Usage:
# perl translate.pl <target-file> <input-file> <input_file> ...
# Target file might be for example locales/fr.json
#
use JSON;

my $Q = qr/["']/;
my $C = qr/[-:\w ]*/;

sub sadd {
    my ($s, $i) = @_;
    $s =~ s/\s+/ /g;
    $s =~ s/$Q + $Q/ /g;
    $s =~ s/\s+/ /g;
    $s =~ s/^\s//;
    $s =~ s/\s^//;
    return $i if $strings{$s};
    $strings{$s} = 1;
    return $i;
}

my @strings;
my $outfile = shift @ARGV;
$/ = undef;
while (@ARGV) {
    my $f = shift @ARGV;
    open(F, "<", $f) || die "Cannot open $f for read";
    print "Reading $f\n";
    $f = <F>;
    close(F);

    $f =~ s/(\bTX.tx\(($Q)(.+?)\2)/sadd($3,$1)/ges;
    #       1        2  2                              3  34   4  1
    $f =~ s/(\bclass=($Q)$C?\bTX_title\b$C\2.*?\btitle=($Q)(.+?)\3)/sadd($4,$1)/ges;
    #       1        2  2                       3   3 1
    $f =~ s/(\bclass=($Q)$C?\bTX_text\b$C?\2.*?>(.+?)<)/sadd($3,$1)/ges;
    close(F);
}

my $json = new JSON;
my $data = {};
if (open(F, "<", $outfile)) {
    $data = $json->utf8->decode(<F>);
    close(F);
    my $changed = 0;
    foreach my $k (keys %$data) {
        if (!defined $strings{$k}) {
            print "Deleting $k\n";
            delete $data->{$k};
            $changed = 1;
        }
    }
}
foreach my $k (keys %strings) {
    if (!defined $data->{$k}) {
        print "Adding $k\n";
        $data->{$k} = "";
        $changed = 1;
    }
}

if ($changed) {
    print "Writing changes to $outfile\n";
    open(F, ">", $outfile);
    open(FF, ">", "strings.txt");
    print F $json->pretty(1)->canonical->utf8->encode($data);
    print FF join("\n", sort keys %$data);
    close(F);
} else {
    print "No changes\n";
}
