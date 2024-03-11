/**
 * Module containing enumerations for application.
 */

const Tab = {
  INPUTS: 'Inputs',
  VISUALIZE: 'Visualize',
  CNC: 'CNC',
  DIMENSIONS: 'Dimensions'
};

const Preset = {
  T_SHAPE: 'T Shape',
  H_SHAPE: 'H Shape',
  STAR_SHAPE: 'Star Shape',
  T_SHAPE_2F: 'T Shape 2F',
  H_SHAPE_4F: 'H Shape 4F'
};

const Assembly = {
  WIND_TURBINE: 'WindTurbine',
  STATOR_MOLD: 'StatorMold',
  ROTOR_MOLD: 'RotorMold',
  MAGNET_JIG: 'MagnetJig',
  COIL_WINDER: 'CoilWinder'
};

export { Tab, Preset, Assembly };
