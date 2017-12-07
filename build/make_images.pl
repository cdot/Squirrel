opendir(D, "images") || die $!;
foreach my $f (readdir D) {
    if ($f =~ /^(.*)\.svg$/ && $1 ne 'squirrel') {
        print "$f\n";
        foreach my $s ( 16, 18, 36 ) {
            `convert images/$1.svg -resize ${s}x$s images/$1$s.png`;
        }
    }
}
closedir(D);
`convert images/squirrel.svg -resize ${s}x$s images/squirrel500.png`;
