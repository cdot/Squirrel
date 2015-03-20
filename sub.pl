#!/usr/bin/perl
$/ = undef;
open(F, "<", $ARGV[0]);
$x = <F>;
for ($i = 1; $i < scalar(@ARGV); $i++) {
    $x =~ s{<!--$ARGV[$i]-->}{$ARGV[++$i]}sg;
}
print $x;
