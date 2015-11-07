Setting up the turn server:

Coturn server: https://github.com/coturn/coturn
Version: Coturn-4.4.5.3 'Ardee West'

After following installation instructions, the following command line has worked correctly for getting the turn server running:

turnserver --lt-cred-mech --static-auth-secret [turn_shared_secret] --realm chatsurfing.com --max-bps 15000

Note: turn_shared_secret is set in constants.py, and must match the value defined there.
Note: your realm will not be chatsurfing.com, it will be your website.
Note: max-bps is optional, but by setting lower values you can lower your turn server costs.