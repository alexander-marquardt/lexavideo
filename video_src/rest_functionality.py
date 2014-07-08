#!/usr/bin/python2.4
#

import vidsetup

import cgi
import logging
import os
import random
import re
import json
import jinja2
import webapp2
import threading
from google.appengine.api import channel
from google.appengine.ext import ndb

from python_src import status_reporting, http_helpers, models

# We "hack" the directory that jinja looks for the template files so that it is always pointing to
# the correct location, irregardless of if we are in the debug or production build. 
jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__) + "/" + vidsetup.BASE_STATIC_DIR))

def handle_exceptions(func):
    # wrap a method inside a try/except block
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:
            self = args[0]
            http_helpers.set_response_and_write_log(self.response, 500, "Internal Error", logging.error) 
            
    return wrapper
            

def set_response_to_json(response, dict_to_jsonify):
    # simple helper function to set response output to a json version of the dict_to_jsonify that is passed in.
    response.headers['Content-Type'] = 'application/json'  
    response.out.write(json.dumps(dict_to_jsonify))   
    

class MainPage(webapp2.RequestHandler):
    def get(self):
        template_values = {}
        target_page = 'index.html'
        template = jinja_environment.get_template(target_page)
        self.response.out.write(template.render(template_values))
        
class AdminPage(webapp2.RequestHandler):
    def get(self):
        template_values = {'is_admin_view' : True}
        target_page = 'index.html'
        template = jinja_environment.get_template(target_page)
        self.response.out.write(template.render(template_values))    
        
        
class HandleProducts(webapp2.RequestHandler):

    @handle_exceptions
    def get(self):
        products_query = models.ProductForSale.query()
        products_list = []
        
        for product in products_query:
            product_dict = product.to_dict()
            product_dict['id'] = product.key.id()
            products_list.append(product_dict)

        set_response_to_json(self.response, products_list)

    @handle_exceptions        
    def post(self, product_id=None):
        json_object = json.loads(self.request.body)
        product_dict = json_object
        product_dict['price'] = int(product_dict['price'])
        
        
        if product_id:
            # update an existing item:
            del product_dict['id']
            product_id = int(product_id)
            product_for_sale = models.ProductForSale.get_by_id(product_id)
            product_for_sale.populate(**product_dict)
        else:
            product_for_sale = models.ProductForSale(**product_dict)
            
        product_for_sale.put()   
        product_for_sale_dict = product_for_sale.to_dict()
        product_for_sale_dict['id'] = product_for_sale.key.id()

        set_response_to_json(self.response, product_for_sale_dict)

            
    @handle_exceptions
    def delete(self, product_id):
        
        product_id = int(product_id)
        if product_id:
            product_for_sale = models.ProductForSale.get_by_id(product_id)
            if product_for_sale:
                product_for_sale.key.delete()
                set_response_to_json(self.response, {'status' : "OK", 'message' : "deleted id %d" % product_id})
            else:
                set_response_to_json(self.response, {'status' : "Warning", 'message' : "not found id %d" % product_id})
                
    @handle_exceptions
    def put(self):  
        logging.info("Called wilth PUT")
        
class StorePurchaseOrder(webapp2.RequestHandler):
    def post(self):
        
        # Note: AngularJS posts json objects by default, so the standard self.request.get will not work.
        
        try:
            
            json_object = json.loads(self.request.body)
            products_list = json_object['products']
            del json_object['products'] 
            purchase_order = models.OrderReceived(**json_object)
            purchase_order.put()
            order_id = purchase_order.key.id()

            for product in products_list:
                new_product = models.ItemPurchased(**product)
                new_product.order_object_reference = purchase_order.key
                new_product.put()
                
            set_response_to_json(self.response, {'id': order_id})

        except:
            http_helpers.set_response_and_write_log(self.response, 404, "PurchaseOrders.post - Internal Error" , logging.warning)             
        
        
class ShowOrders(webapp2.RequestHandler):
    
    
    def get(self):
        order_query = models.OrderReceived.query() # get all orders
        order_list = []
        for order in order_query:
            order_dict = order.to_dict()
            
            # now get all items associated with each order, and append it to the order as ".products" (as expected by the client side code)
            items_list = models.ItemPurchased.query(models.ItemPurchased.order_object_reference == order.key)
            item_dict = [item.to_dict() for item in items_list]
            # remove key of the order object from the items dictionary            
            for item in item_dict:  del item['order_object_reference']
            order_dict['products'] = item_dict
            order_list.append(order_dict)
        
        set_response_to_json(self.response, order_list)
             
            
class VerifyLogin(webapp2.RequestHandler):
    
    def post(self):
        try:
            json_object = json.loads(self.request.body)   
            logging.info("Received post containing:" + repr(json_object))
            
        except:
            http_helpers.set_response_and_write_log(self.response, 404, "VerifyLogin.post - Internal Error" % logging.warning)
            
            
            
            
app = webapp2.WSGIApplication([
    (r'/', MainPage),
    (r'/index.html', MainPage),
    (r'/admin.html', AdminPage),
    webapp2.Route(r'/products/<product_id:\d+>', HandleProducts),
    webapp2.Route(r'/products', HandleProducts),
    
    (r'/post/purchase_order', StorePurchaseOrder),
    (r'/admin/get_orders', ShowOrders),
    (r'/admin/login', VerifyLogin),
  ], debug=True)

app.error_handlers[404] = http_helpers.handle_404
app.error_handlers[500] = http_helpers.handle_500

