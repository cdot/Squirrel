# Upload a single file to an FTP site. The destination is identified
# FTP parameters stores in a .config file.
use Net::FTP;
use strict;
use Data::Dumper;

my $config = {};

sub get_config {
    my ( $what ) = @_;

    return $config->{$what} if defined $config->{what};

    $config->{changed} = 1;
    local $/ = "\n";
    while (1) {
        print $what;
        print " ($config->{$what})" if $config->{$what};
        print ': ';
        my $response = <STDIN>;
        chomp($response);
        return $config->{$what} if $config->{$what} && $response eq '';
        $config->{$what} = $response;
    }
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
$ftp->put($ARGV[0], get_config('PATH')."/$ARGV[0]");
$ftp->quit();

if ($config->{changed}) {
    delete $config->{changed};
    die $! unless (open(F, '>', "$ENV{HOME}/.config/squirrel"));
    print F Data::Dumper->Dump([$config], ['config']);
    close(F);
}

1;
