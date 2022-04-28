import Joi from "Joi";

const schema = Joi.object({
    name: Joi
        .string()
        .alphanum()
        .required(),

    lastStatus: Joi
        .integer()
        .required()
})
// .with('name', 'lastStatus');

export default schema;


// schema.validate({ username: 'abc', birth_year: 1994 });
// -> { value: { username: 'abc', birth_year: 1994 } }

// schema.validate({});
// -> { value: {}, error: '"username" is required' }

// Also -

// try {
//     const value = await schema.validateAsync({ username: 'abc', birth_year: 1994 });
// }
// catch (err) { }