

from video_src import models

def create_new_user():

    new_user_obj = models.UserModel()
    new_user_obj.put()

    # use the key as the username until they decide to create their own username.
    new_user_name = new_user_obj.key.id()
    new_user_obj.user_id = str(new_user_name)
    new_user_obj.put()
    return new_user_obj

def get_user(user_id):
    # queries database for user and returns the user object
    user_obj = models.UserModel.get_by_id(user_id)
    return user_obj

def delete_user(user_id):
    # removes  particular user from the database
    user_obj = models.UserModel.get_by_id(user_id)
    user_obj.key.delete()
