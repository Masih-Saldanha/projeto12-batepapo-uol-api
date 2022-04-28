import Joi from "joi";

const schema = Joi.object({
    name: Joi
        .string()
        .alphanum()
        .min(1)
        .required(),

    lastStatus: Joi
        .number()
        .integer()
        .required()
});

export default schema;