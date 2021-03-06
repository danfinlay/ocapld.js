/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const jsigs = require('jsonld-signatures');
const utils = require('./utils');
const {ControllerProofPurpose} = jsigs.purposes;

module.exports = class CapabilityDelegation extends ControllerProofPurpose {
  /**
   * @param capabilityChain {array} an array of capabilities with the first
   *   entry representing the root capability and the last representing the
   *   parent of the capability to be delegated or validated.
   * @param [verifiedParentCapability] the previously verified parent
   *   capability, if any.
   * @param [expectedTarget] {string} the target we expect a capability to
   *   apply to (URI).
   * @param [capability] {string or object} the capability that is to be
   *   added/referenced in a created proof.
   * @param [capabilityAction] {string} the capability action that is
   *   to be added to a proof or is expected when validating a proof.
   * @param [caveat] {object or array} one or more Caveat instances that
   *   can be used to check whether or not caveats have been met when
   *   verifying a proof.
   * @param {Object or Array} suite - the jsonld-signature suites to use to
   *   verify the capability chain.
   * @param [controller] {object} the description of the controller, if it
   *   is not to be dereferenced via a `documentLoader`.
   * @param [date] {string or Date or integer} the expected date for
   *   the creation of the proof.
   * @param [maxTimestampDelta] {integer} a maximum number of seconds that
   *   the date on the signature can deviate from, defaults to `Infinity`.
   */
  constructor({
    capabilityChain, verifiedParentCapability,
    expectedTarget, capability, capabilityAction, caveat, suite,
    controller, date, maxTimestampDelta = Infinity} = {}) {
    super({
      term: 'capabilityDelegation', controller, date, maxTimestampDelta});
    this.capabilityChain = capabilityChain;
    this.verifiedParentCapability = verifiedParentCapability;
    this.expectedTarget = expectedTarget;
    this.capability = capability;
    this.capabilityAction = capabilityAction;
    if(caveat !== undefined) {
      if(!Array.isArray(caveat)) {
        this.caveat = [caveat];
      } else {
        this.caveat = caveat;
      }
    }
    this.suite = suite;
  }

  async validate(
    proof, {document, verificationMethod, documentLoader, expansionMap}) {
    try {
      // a delegated capability requires a reference to its parent capability
      if(!('parentCapability' in document)) {
        throw new Error(
          `"parentCapability" was not found in the delegated capability.`);
      }

      const {
        capabilityChain, expectedTarget, capability,
        capabilityAction, caveat, suite} = this;
      const purposeParameters = {
        capabilityChain, expectedTarget, capability,
        capabilityAction, caveat, CapabilityDelegation, suite};

      // see if the parent capability has already been verified
      let {verifiedParentCapability} = this;
      if(!verifiedParentCapability) {
        // parent capability not yet verified, so verify delegation chain
        const result = await utils.verifyCapabilityChain({
          capability: document,
          proof,
          purposeParameters,
          documentLoader,
          expansionMap
        });
        if(!result) {
          throw result.error;
        }
        ({verifiedParentCapability} = result);
      }

      purposeParameters.verifiedParentCapability = verifiedParentCapability;

      // ensure parent capability matches
      if(document.parentCapability !== verifiedParentCapability.id) {
        throw new Error('"parentCapability" does not match.');
      }

      // ensure proof created by authorized delegator
      const parentDelegator = verifiedParentCapability.delegator;

      // parent delegator must match the verification method itself OR
      // the controller of the verification method
      if(!(parentDelegator &&
        (parentDelegator === verificationMethod.id ||
        parentDelegator === verificationMethod.controller ||
        parentDelegator === verificationMethod.owner))) {
        throw new Error(
          'The delegator does not match the verification method ' +
          'or its controller.');
      }

      // check verification method controller
      const result = await super.validate(proof, {
        documentLoader, verificationMethod, documentLoader, expansionMap});
      if(!result.valid) {
        throw result.error;
      }

      // finally, ensure caveats are met
      return await utils.checkCaveats({
        capability: document, purposeParameters,
        documentLoader, expansionMap});
    } catch(error) {
      return {valid: false, error};
    }
  }

  async update(proof, {document, documentLoader, expansionMap}) {
    let {capabilityChain} = this;
    if(capabilityChain && !Array.isArray(capabilityChain)) {
      throw new TypeError('"capabilityChain" must be an array.');
    }

    // no capability chain given, attempt to compute from parent
    if(!capabilityChain) {
      const capability = await utils.fetchInSecurityContext(
        {url: document, documentLoader, expansionMap});
      capabilityChain = await utils.computeCapabilityChain(
        {capability, documentLoader, expansionMap});
    }

    proof.proofPurpose = 'capabilityDelegation';
    proof.capabilityChain = capabilityChain;
    return proof;
  }
};
