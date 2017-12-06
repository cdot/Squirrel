#!/usr/bin/perl
# Process strings for translation. Reads the JSON from the input files
# and builds a dictionary that is used to correct the language file
# Usage:
# perl translate.pl <lang> <input-file> <input_file> ...
# <lang> is e.g. "fr", "de"
# Input files are .strings (JSON) files
# Resulting JSON is written to STDOUT
use strict;
use JSON;
use LWP;
use HTTP::Request;
use open IN => ":utf8", out => ":utf8";

my %strings;
my $lang = shift @ARGV;
my $json = new JSON->utf8;

$/ = undef;
binmode STDERR, ":utf8";
binmode STDOUT, ":utf8";

sub add {
    my $s = shift;
    $strings{$s} = $s;
}

# Load the strings
while (@ARGV) {
    my $f = shift @ARGV;
    open(F, "<", $f) || die "Cannot open $f for read";
    print "Reading $f\n";
    $f = $json->decode(<F>);
    close(F);
    foreach my $s (@$f) {
        $strings{$s} = "";
    }
}
use Data::Dumper;
print STDERR Data::Dumper->Dump([\%strings]);
# Load the target file
my $data = {};
my $langfile = "locale/$lang.json";
if (open(F, "<", $langfile)) {
    $data = $json->decode(<F>);
    close(F);
    foreach my $k (keys %$data) {
        if (!defined $strings{$k}) {
            print STDERR "Deleting $k\n";
            delete $data->{$k};
        }
    }
} else {
    print STDERR "Could not load $langfile\n";
}

my @protected;
sub protect {
    my $s = shift;
    push(@protected, $s);
    return "{" . scalar($#protected) . "}";
}

my $ua = LWP::UserAgent->new;
foreach my $k (sort keys %strings) {
    next if ($data->{$k});
    print STDERR "Adding '$k'\n";
    # See if we can get a translation from MyMemory
    my $uk = $k;
    @protected = ();
    $uk =~ s/([{$}]|<[^>]+>)/protect($1)/ges;
    print STDERR "Get translation for '$uk'\n";
    $uk =~ s{([^0-9a-zA-Z-_.:~!*/"'])}{sprintf('%%%02x',ord($1))}ge;
    my $uri = "http://api.mymemory.translated.net/get?q=$uk\\&langpair=en\\|$lang";

    # Pass request to the user agent and get a response back
    my $res = `curl -# $uri`;

    # Check the outcome of the response
    my $tx;
    #print STDERR "RESPONSE: $res\n";
    eval { $res = JSON::from_json($res); };
    if ($@) {
        print STDERR "Bad response $res: $@\n";
    } else {
        $tx = $res->{responseData}->{translatedText};
        if ($tx =~ /INVALID LANGUAGE PAIR SPECIFIED/) {
            print STDERR "Bad response $tx\n";
        } else {
            print STDERR "Translation '$tx'\n";
            $tx =~ s/\{(\d+)\}/$protected[$1]/ge;
            $data->{$k} = $tx;
        }
    }
}

print $json->pretty(1)->canonical->utf8->encode($data);

