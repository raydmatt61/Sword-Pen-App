'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Utility to strip undefined values from an object before sending to Firestore.
 * Firestore rejects explicit 'undefined' values.
 */
function stripUndefined(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  return Object.keys(obj).reduce((acc: any, key) => {
    if (obj[key] !== undefined) {
      acc[key] = stripUndefined(obj[key]);
    }
    return acc;
  }, {});
}

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  const operation = options && 'merge' in options ? 'write' : 'create';
  const cleanData = stripUndefined(data);
  
  setDoc(docRef, cleanData, options || {}).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: operation, 
        requestResourceData: cleanData,
      })
    )
  })
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const cleanData = stripUndefined(data);
  const promise = addDoc(colRef, cleanData)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: cleanData,
        })
      )
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  const cleanData = stripUndefined(data);
  updateDoc(docRef, cleanData)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: cleanData,
        })
      )
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      )
    });
}
