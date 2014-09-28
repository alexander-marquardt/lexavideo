

from video_src import models

def create_new_user():

    new_user_obj = models.UserModel()
    new_user_obj.put()

    # use the key as the username until they decide to create their own username.
    new_user_name = new_user_obj.key.id()
    new_user_obj.user_name = str(new_user_name)
    new_user_obj.put()
    return new_user_obj

def get_user(user_name):
    # queries database for user and returns the user object
    user_obj = models.UserModel.get_by_id(user_name)
    return user_obj

def delete_user(user_name):
    # removes  particular user from the database
    user_obj = models.UserModel.get_by_id(user_name)
    user_obj.key.delete()
