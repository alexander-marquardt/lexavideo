Setting up the turn server:


Version Coturn-4.5.0.3 'dan Eider'

Installed on Ubuntu 16.0.4 with the following commands:

    sudo apt-get update -y
    sudo apt-get install -y coturn


Be sure to open required ports (TCP and UDP) - the following may be too generous

3478 and 3479 (standard listening-port and alternative listening port)
5349 and 5350 (standard tls-listening-port and alternative tls-listening-port)
49152 - 65535 (standard relay ports)

The following command line has worked correctly for getting the turn server running:
turnserver --lt-cred-mech --static-auth-secret [turn_shared_secret] --realm chatsurfing --max-bps 200000

Note: turn_shared_secret is set in constants.py, and must match the value defined there.
Note: your realm will not be chatsurfing.com, it will be your website.
Note: max-bps is optional, but by setting lower values you can lower your turn server costs.


Created a serivice on the VM

/etc/systemd/system/turnserver.service

[Unit]
Description=Run the turnserver (coturn)
After=network.target
[Service]
User=alexander_marquardt
Type=forking
Restart=always
ExecStart=/usr/bin/turnserver --lt-cred-mech --static-auth-secret AlexFromCanada19721234567890ABCDIsXXXTTTTfjgklfdsjgfkldsjkl --realm chatsurfing.com --max-bps 300000 --daemon
[Install]
WantedBy=multi-user.target
~


sudo systemctl start turnserver
sudo systemctl status turnserver
systemctl enable turnserver (to set it to start at boot).

Firefox can force the video through turn as documented at:
https://stackoverflow.com/questions/34030188/easy-way-to-test-turn-server/39490790#39490790

