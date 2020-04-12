Setting up the turn server:


Version Coturn-4.5.0.3 'dan Eider'

Installed on Ubuntu 16.0.4 with the following commands:

    sudo apt-get update -y
    sudo apt-get install -y coturn

The following command line has worked correctly for getting the turn server running:

turnserver --lt-cred-mech --static-auth-secret [turn_shared_secret] --realm chatsurfing.com --max-bps 15000

Note: turn_shared_secret is set in constants.py, and must match the value defined there.
Note: your realm will not be chatsurfing.com, it will be your website.
Note: max-bps is optional, but by setting lower values you can lower your turn server costs.


Createdf a serivice on the VM

/etc/systemd/system/turnserver.service

[Unit]
Description=Example systemd service.
[Service]
Type=simple
ExecStart=/usr/bin/turnserver --lt-cred-mech --static-auth-secret AlexFromCanada19721234567890ABCDIsXXXTTTTfjgklfds
jgfkldsjkl --realm chatsurfing.com --max-bps 15000 --daemon


sudo systemctl start turnserver
sudo systemctl status turnserver
