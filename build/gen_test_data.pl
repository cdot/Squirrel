# Generate new large test data on STDOUT for use with
# the node.js.server.js server
#
# Run in the 'build' directory
my $t = 1541588100000;
my $tstep = 65000;

my $d = {
    name  => "Test",
    last_sync => null,
    actions => [],
    cache => null,
    options => {
        store_path => "Test"
    },
    version => 2
};

sub add {
    my ($type, $path, $data) = @_;
    my $a = {
        type => $type,
        path => $path,
        time => $t
    };
    if (defined $data) {
        $a->{data} = $data;
    }
    push(@{$d->{actions}}, $a);
    $t += $tstep;
}

my $i, $j, $k;
foreach $i ('A'..'J') {
    add('N', [ $i ]);
    foreach $j ('0'..'9') {
        add('N', [ $i, $j ]);
        foreach $k ('K'..'T') {
            add('N', [ $i, $j, $k ], "$i/$j/$k");
        }
    }
}
# Alarms
add('A', [ 'A' ], $t);
add('A', [ 'B', '0' ], $t);
add('A', [ 'C', '1', 'K' ], $t);
# Constraints
add('X', [ 'D' ], $t);
add('X', [ 'E', '0' ], "K-T");
add('X', [ 'F', '1', 'K' ], "0-9");

use JSON;
my $p = JSON->new->encode($d);
# Make 16-bit characters
print join("\0", split(//, $p)) . "\0";
