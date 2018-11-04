/**
 * Linked Data Signatures/Proofs
 *
 * @author Christopher Lemmer Webber
 * @author Ganesh Annan <gannan@digitalbazaar.com>
 * 
 * @license BSD 3-Clause License
 * Copyright (c) 2018 Digital Bazaar, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of the Digital Bazaar, Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
'use strict';

const jsigs = require('jsonld-signatures');
const vocab = require('./vocab');

const api = {};
module.exports = api;


api.checkExpireAtCaveat = async (caveat, invocation, proof, proofPurposeOptions) => {
  const {expireAtUri} = vocab;

  let currDate;
  if ('getDate' in proofPurposeOptions) {
    currDate = proofPurposeOptions.getDate();
  } else {
    currDate = new Date();
  }
  const expiresDate = new Date(api.getOneOrDie(proofPurposeOptions[expireAtUri]));
  return currDate <= expiresDate;
};

api.checkRestrictActionCaveat = (caveat, invocation, proof, proofPurposeOptions) => {
  const {restrictActionUri} = vocab;

  return caveat[restrictActionUri].includes(api.getOneOrDie(invocation['@type']));
};

api.getCapTarget = async (cap, proofPurposeOptions) => {
  throw new Error('Not Implemented!');
};

api.getCapInvokers = async (cap, proofPurposeOptions) => {
  throw new Error('Not Implemented!');
};

api.getOneOrDie = (array, errorMessage = 'Expected an array of size 1') => {
  if (!Array.isArray(array) || array.length != 1) {
    throw new Error(errorMessage);
  }
  return array[0];
};

// Check if obj is an object that is of length 1 and has an @id,
// and only an @id
api.idOnlyObject = (obj) => {
  return obj.length === 1 && obj['@id'] != undefined;
};

api.verifyCap = async (cap, proofPurposeOptions) => {
  const {parentCapabilityUri, capabilityDelegationUri} = vocab;

  if (!(parentCapabilityUri in cap)
      && capabilityDelegationUri in cap) {
    // It's the toplevel capability, which means it's valid
    return true;
  } else {
    // Otherwise, we have to check the signature
    return jsigs.verify(cap, {
      proofPurpose: 'CapabilityDelegation',
      proofPurposeOptions: proofPurposeOptions
    });
  }
};