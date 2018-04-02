#!/usr/bin/perl
# Rewrite an HTML file replacing "file?version=" with the current version,
# either from git or, if modified locally, from the mtime
sub revise {
    my $f = shift;
    my $version = "$f?version=";
    my $changed = `git diff --name-only $f`;
    if ($changed) {
        #print "$f: changed";
        $version .= (stat($f))[9];
    } else {
        #print "$f: unchanged\n";
        my $commit = `git log -n 1 $f`;
        if ($commit =~ /^commit\s+(\w+).*$/s) {
            $version .= $1;
        } else {
            die "No commit $commit";
        }
    }
    #print "$version\n";
    return $version;
}

open(F,"<", $ARGV[0]) || die "Whoops $!";
undef $/;
my $mf = <F>;
close(F);
$mf =~ s{([^"']+)\?version=[a-zA-Z0-9]+}{revise($1)}ges;
open(F, ">", $ARGV[0]) || die "Whoops $!";
print F $mf;
close F;
1;

    
