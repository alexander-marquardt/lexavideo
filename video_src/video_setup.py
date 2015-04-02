
import logging

from google.appengine.ext import ndb


"""
VideoSetup - used in the determination of which "client" will be the rtcInitiator, and which will be the
receiver.
An object of this type will be created every time a pair of clients starts to initiate a video session.
Each object corresponding to this type will be keyed by a combination of the client ids, with the first
id corresponding to the "lower" id value and the second id corresponding to the "higher" value.
"""
class VideoSetup(ndb.Model):
    # video_elements_enabled_client_ids should only ever have two entries given the current video
    # configuration which is direct peer-to-peer. When a user starts video, they will be added to this
    # array, and when they stop and/or leave a room they will be removed from this array.
    # When the second user activates their video, then WebRTC signaling will start between the two users.
    video_elements_enabled_client_ids = ndb.StringProperty(repeated=True)

    # There may be cases where these objects don't get cleaned up correctly, and the creation_date
    # will help us find and remove old objects.
    creation_date = ndb.DateTimeProperty(auto_now_add=True)


    @classmethod
    def get_ordered_client_ids(cls, client_id_1, client_id_2):
        if (client_id_1 < client_id_2):
            return client_id_1, client_id_2
        else:
            return client_id_2, client_id_1

    @classmethod
    def get_vid_setup_id_for_client_id_pair(cls, client_id_1, client_id_2):
        lower_id, higher_id = cls.get_ordered_client_ids(client_id_1, client_id_2)
        return lower_id + '&' + higher_id




    @classmethod
    @ndb.transactional
    def txn_add_user_id_to_video_elements_enabled_client_ids(cls, from_client_id, to_client_id, ):

        vid_setup_id = VideoSetup.get_vid_setup_id_for_client_id_pair(from_client_id, to_client_id)
        vid_setup_obj = VideoSetup.get_by_id(vid_setup_id)
        if not vid_setup_obj:
            vid_setup_obj = VideoSetup(id=vid_setup_id)

        if from_client_id not in vid_setup_obj.video_elements_enabled_client_ids:

            vid_setup_obj.video_elements_enabled_client_ids.append(from_client_id)
            vid_setup_obj.put()
        else:
            logging.info('Client %s not added to video_enabled_ids %s' %(to_client_id, vid_setup_id))

        return vid_setup_obj


    @classmethod
    @ndb.transactional
    def txn_remove_user_id_from_video_elements_enabled_client_ids(cls, from_client_id, to_client_id, ):

        vid_setup_id = VideoSetup.get_vid_setup_id_for_client_id_pair(from_client_id, to_client_id)
        vid_setup_obj = VideoSetup.get_by_id(vid_setup_id)

        if (vid_setup_obj):

            if from_client_id in vid_setup_obj.video_elements_enabled_client_ids:
                vid_setup_obj.video_elements_enabled_client_ids.remove(from_client_id)

                # If this is the last user in the VideoSetup object, then remove the object as it will never
                # be accessed again.
                if (len(vid_setup_obj.video_elements_enabled_client_ids) == 0):
                    vid_setup_obj.key.delete()
                else:
                    vid_setup_obj.put()

            else:
                logging.warning('client_id %s not found in VideoStup object: %s. Not removed!' % (from_client_id, vid_setup_id))

        else:
            # It may happen that the remote user has disconnected their channel, in which case all VideoSetup objects
            # associated with that user have already been deleted. If the local user had setup video to a remote
            # user that disconnected, then this branch will be executed as the VideoSetup object was previously removed.
            logging.warning('vid_setup_object not found')

        return vid_setup_obj


    @classmethod
    def remove_video_setup_objects_containing_client_id(cls, client_id):
        # find all video_setup_objects that have a reference to client_id, and remove the object
        # (since this is called when the user disconnects the page, the client_id that was used
        # will never be used again, and the object can be removed.

        q = VideoSetup.query()
        q = q.filter(VideoSetup.video_elements_enabled_client_ids == client_id)
        video_setup_object_keys = q.fetch(keys_only=True)
        for k in video_setup_object_keys:
            k.delete()
