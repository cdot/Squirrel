# Update all modules installed npm -g install
# Run as root
for module in /usr/local/lib/node_modules/*; do
    npm -g update $module
done
