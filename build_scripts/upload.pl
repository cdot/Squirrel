#!/usr/bin/perl
# Upload a single file to an FTP site. The destination is identified
# FTP parameters stores in a .config file.
use Net::FTP;
use strict;
use Data::Dumper;
use File::Spec;

my $config = {};

sub get_config {
    my ( $what ) = @_;

    return $config->{$what} if defined $config->{$what};

    my $changed = 1;
    local $/ = "\n";
    while (1) {
        print $what;
        print " ($config->{$what})" if $config->{$what};
        print ': ';
        my $response = <STDIN>;
        chomp($response);
        last if $config->{$what} && $response eq '';
        $config->{$what} = $response;
    }
    die $! unless (open(F, '>', "$ENV{HOME}/.config/squirrel"));
    print F Data::Dumper->Dump([$config], ['config']);
    close(F);
    return $config->{$what};
}

# Load shared configuration file
if( open(F, '<', "$ENV{HOME}/.config/squirrel")) {
    $/ = undef;
    eval(<F>);
    die $@ if $@;
    close(F);
}

my $ftp = Net::FTP->new(
    Host => get_config('FTP_HOST'),
    Timeout => 15);
die "FTP Connect failed: $@" unless $ftp;

die "FTP login failed\n" unless
    $ftp->login(get_config('FTP_USER'), get_config('FTP_PASS'));

$ftp->binary();

sub putfile {
    my ($ftp, $from, $to) = @_;
    my @path = split(/\/+/, $to);
    pop(@path);
    my @missing;

    while (scalar @path) {
        my $path = join('/', @path);
        my $res = $ftp->ls($path);
        last if defined $res;
        my $dir = join('/', @path, pop(@path));
        print "mkdir $dir\n";
        die unless $ftp->mkdir($dir);
    }

    my $mod = $ftp->mdtm($to);
    if ($mod < (stat($from))[9]) {
        print "Uploading $to\n";
        unless ( $ftp->put($from, $to) ) {
            print STDERR "FAILED Upload of $from failed $@ $!\n";
        }
    } else {
        print "Skipped $from, $to is up-to-date ($mod)\n";
    }
}

foreach my $arg (sort @ARGV) {
    if ($arg =~ /:/) {
        my ($from, $to) = split(':', $arg);
        my ($vol, $dir, $file) = File::Spec->splitpath($from);
        $dir .= '/' if $dir && $dir !~ m{/$};
        putfile($ftp, $from, get_config('PATH')."/$to/$file");
    } else {
        putfile($ftp, $arg, get_config('PATH')."/$arg");
    }
}
$ftp->quit();

1;
