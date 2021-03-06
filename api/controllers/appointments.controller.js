const moment = require('moment');
const { getPlaceForDose } = require('./vaccination.controller');
const Appointment = require('../schemas/Appointment.schema');
const Vaccination = require('../schemas/Vaccination.schema');
const User = require('../schemas/User.schema');
const mongoose = require('mongodb');

const validateAppointment = require('./helpers/validateAppointment');

const createUser = async (req, res, nextDoseDate) => {
  const user = new User(req.body);

  //Body Validation with joi
  const validate = user.validateNew(req.body);

  if (validate.error) {
    res.status(400).send({ message: 'INVALID_BODY' });
    return;
  }
  user.next_dose_date = nextDoseDate;

  await user
    .save()
    .catch((e) => console.log('ERROR SAVING NEW VACCINE PLACE =>', e));

  return user;
};

const newAppointment = async (req, res) => {
  if (!req.body || !Object.keys(req.body).length)
    res.status(400).send({ message: 'BAD_REQUEST, line 32' });

  let user = await User.findOne({ dni: req.body.dni });
  let appointment;
  const nextDoseDate = moment().add(2, 'days');

  //If user exists, we have to check if the state of the appointment
  //wether 2 months already passed from last vaccine application
  //or he doesnt have another appointment not completed
  if (user) {
    appointment = await Appointment.findOne({ user_id: user._id })
      .populate('place_id')
      .populate('user_id');
    if (user.dose >= 2) {
      res
        .status(400)
        .send({ message: 'The user already has 2 doses applied', user });
      return;
    }
    if (appointment) {
      const validate = validateAppointment(appointment);
      if (validate.statusCode === 400) {
        res.send({ code: validate.statusCode, ...validate.body });
        return;
      }
    }
  } else {
    user = await createUser(req, res, nextDoseDate);
    if (!user) return;
  }

  //In case, none of those is true, it means we can generate a new Appointment
  const placeForDose = await getPlaceForDose();

  appointment = new Appointment({
    place_id: placeForDose._id,
    user_id: user._id,
    date: nextDoseDate,
    state_process: 'IN_PROGRESS',
  });

  const uploadedAppointment = await appointment
    .save()
    .catch((e) => console.error('ERROR IN APPOINTMENT CREATION', e));

  placeForDose.dosesInProgress
    ? placeForDose.dosesInProgress.push(appointment)
    : (placeForDose.dosesInProgress = [appointment]);

  await Vaccination.findByIdAndUpdate(placeForDose._id, {
    dosesInProgress: placeForDose.dosesInProgress,
  }).catch((e) =>
    console.error('ERROR IN Vaccination UPDATE from NEW APPOINTMENT', e)
  );

  const response = await Appointment.findById(uploadedAppointment._id)
    .populate('place_id')
    .populate('user_id');

  res.send({
    message: 'New appointment created successfully',
    appointment: response,
  });
};

/**
 * @query { _id: gets an appointment by id, place_id: Filter Appointments by PLACE, user_id: Filter Appointments by user, state_process: Filter Appointments by progress => enum[IN_PROGRESS, COMPLETED], populate: true/false => brings user and place data also}
 */
const getAppointments = async (req, res) => {
  let appointments;
  const miQuery = req.query;

  if (!Object.keys(miQuery).length) {
    appointments = await Appointment.find();
    res.send({ appointments });
    return;
  }
  if (miQuery.user_dni) {
    const user_id = await User.findOne({ dni: miQuery.user_dni });
    delete miQuery.user_dni;
    miQuery.user_id = user_id;
  }

  if (Boolean(miQuery.populate)) {
    delete miQuery.populate;
    appointments = await Appointment.find({ ...miQuery })
      .populate('place_id')
      .populate('user_id');
  } else {
    appointments = await Appointment.find({ ...miQuery });
  }

  res.send({ appointments });
};

const updateAppointment = async (req, res) => {
  res.send('UPDATE APPOINTMENTS');
};

const deleteAppointment = async (req, res) => {
  res.send('DELETE APPOINTMENTS');
};

module.exports = {
  getAppointments,
  newAppointment,
  updateAppointment,
  deleteAppointment,
};
