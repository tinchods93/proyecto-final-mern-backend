const Vaccine = require('../schemas/Vaccination.schema');
const uuid = require('uuid');
const dataVaccination = require('../data_vaccination.json');

module.exports = async () => {
  Vaccine.estimatedDocumentCount(async (err, count) => {
    if (!err && count === 0) {
      for await (const vaccination of dataVaccination.vaccination) {
        const vaccine = new Vaccine(vaccination);
        await vaccine.save().catch((e) => console.error(e));
      }
      console.log('Initial Setup Finished');
    }
  });
};
