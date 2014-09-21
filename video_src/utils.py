

def to_camel_case(snake_str):
    components = snake_str.split('_')
    # We capitalize the first letter of each component except the first one
    # and join them together.
    return components[0] + "".join(x.title() for x in components[1:])