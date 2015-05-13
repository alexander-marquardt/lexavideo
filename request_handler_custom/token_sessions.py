__author__ = 'alexandermarquardt'

import jwt

from video_src import constants

def generate_jwt_token(user_obj):

    encode_dict = {'user_id': user_obj.key.id()}
    jwt_token = jwt.encode(encode_dict, constants.secret_key, algorithm='HS256')

    return jwt_token


def get_jwt_token_payload(authorization_header):

    if authorization_header:
        (bearer_txt, split_char, token) = authorization_header.partition(' ')
        token_payload = jwt.decode(token, constants.secret_key)
    else:
        token_payload = {}

    return token_payload