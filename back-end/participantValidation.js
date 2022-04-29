import Joi from "joi";

const participantValidation = Joi.object({
    name: Joi
        .string()
        .min(1)
        .required(),

    lastStatus: Joi
        .number()
        .integer()
        .required()
});

export default participantValidation;