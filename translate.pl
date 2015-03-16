# Extract strings for translation from sources
use JSON;

my @strings;
while (<>) {
    while ($_ =~ s/\bTX.tx\((["'])(.*?)\1//) {
        $strings{$2} = 1;
    }
    while ($_ =~ s/\bSquirrel\.\w+\.status\s*=\s*["'](.*?)\1//) {
        $strings{$2} = 1;
    }
    while ($_ =~ s/\bTX_title\b.*?title=(["'])(.*?)\1//) {
        $strings{$2} = 1;
    }
    while ($_ =~ s/\bTX_text\b.*?>(.*?)<//) {
        my $s = $1;
        $s =~ s/\s+/ /;
        $s =~ s/^\s//; $s =~ s/\s^//;
        $strings{$s} = 1;
    }
}

my $json = new JSON;
opendir(D, "locale") || die $!;
for my $f (readdir D) {
    next unless $f =~ /^(.*)\.json$/;
    $f = "locale/$f";
    print STDERR "Processing $f\n";
    my $lang = $1;
    local $/;
    open(F, "<", $f);
    my $data = $json->utf8->decode(<F>);
    close(F);
    my $changed = 0;
    foreach my $k (keys %$data) {
        if (!defined $strings{$k}) {
            print STDERR "Deleting $k\n";
            delete $data->{$k};
            $changed = 1;
        }
    }
    foreach my $k (keys %strings) {
        if (!defined $data->{$k}) {
            print STDERR "Adding $k\n";
            $data->{$k} = "";
            $changed = 1;
        }
    }
    if ($changed) {
        print STDERR "Writing changes to $f\n";
        open(F, ">", $f);
        print F $json->pretty(1)->canonical->utf8->encode($data);
        close(F);
    }
}

