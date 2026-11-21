<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case MandateNotFound = 'mandate_not_found';
    case MandateUnitNotFound = 'mandate_unit_not_found';
    case MandateAgencyOnly = 'mandate_agency_only';
    case MandateNotDraft = 'mandate_not_draft';
    case MandateNotRunning = 'mandate_not_running';
    case MandateNotActive = 'mandate_not_active';
    case MandateNotSuspended = 'mandate_not_suspended';
    case MandateArchived = 'mandate_archived';
    case MandateNotArchivable = 'mandate_not_archivable';
    case MandateStaleVersion = 'mandate_stale_version';
    case MandateOverlap = 'mandate_overlap';
    case MandateUnitConflict = 'mandate_unit_conflict';
    case MandateLastUnit = 'mandate_last_unit';
    case MandateTermConflict = 'mandate_term_conflict';
    case MandatePeriodInvalid = 'mandate_period_invalid';
    case MandateNoUnit = 'mandate_no_unit';
    case MandateSignatureInvalid = 'mandate_signature_invalid';
    case MandateFeeInvalid = 'mandate_fee_invalid';
    case MandateUnitNotAvailable = 'mandate_unit_not_available';
    case MandatePartyNotAvailable = 'mandate_party_not_available';
    case MandateTerminationInvalid = 'mandate_termination_invalid';
    case MandateRenewalInvalid = 'mandate_renewal_invalid';
    case OwnerAccessReadOnly = 'owner_access_read_only';
    case OwnerRoleForbidden = 'owner_role_forbidden';
    case OwnerAgencyNotFound = 'owner_agency_not_found';
    case OwnerMandateNotFound = 'owner_mandate_not_found';
    case OwnerUnitNotFound = 'owner_unit_not_found';
    case OwnerDocumentNotFound = 'owner_document_not_found';
    case MandateEndRequestNotFound = 'mandate_end_request_not_found';
    case MandateEndRequestNotPending = 'mandate_end_request_not_pending';
    case MandateAmendmentSignatureRequired = 'mandate_amendment_signature_required';
    case MandateDocumentInvalid = 'mandate_document_invalid';
    case MandateDocumentNotFound = 'mandate_document_not_found';
    case MandateAmendmentDocumentLocked = 'mandate_amendment_document_locked';
    case MandateTermDefaultsNotFound = 'mandate_term_defaults_not_found';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::MandateNotFound, self::MandateUnitNotFound, self::OwnerAgencyNotFound, self::OwnerMandateNotFound, self::OwnerUnitNotFound, self::OwnerDocumentNotFound, self::MandateEndRequestNotFound, self::MandateDocumentNotFound, self::MandateTermDefaultsNotFound => 404,
            self::MandateAgencyOnly, self::OwnerAccessReadOnly, self::OwnerRoleForbidden => 403,
            self::MandatePeriodInvalid, self::MandateNoUnit, self::MandateSignatureInvalid, self::MandateFeeInvalid,
            self::MandateUnitNotAvailable, self::MandatePartyNotAvailable, self::MandateTerminationInvalid,
            self::MandateRenewalInvalid, self::MandateAmendmentSignatureRequired, self::MandateDocumentInvalid => 422,
            default => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::MandateNotFound => 'Mandat introuvable',
            self::MandateUnitNotFound => 'Lot du mandat introuvable',
            self::MandateAgencyOnly => 'Fonction réservée aux agences',
            self::MandateNotDraft => 'Mandat déjà activé',
            self::MandateNotRunning => 'Mandat non en cours',
            self::MandateNotActive => 'Mandat non actif',
            self::MandateNotSuspended => 'Mandat non suspendu',
            self::MandateArchived => 'Mandat archivé',
            self::MandateNotArchivable => 'Mandat non archivable',
            self::MandateStaleVersion => 'Mandat modifié entre-temps',
            self::MandateOverlap => 'Lot déjà couvert par un mandat',
            self::MandateUnitConflict => 'Lot déjà rattaché au mandat',
            self::MandateLastUnit => 'Dernier lot du mandat',
            self::MandateTermConflict => 'Conditions déjà définies à cette date',
            self::MandatePeriodInvalid => 'Période invalide',
            self::MandateNoUnit => 'Lot manquant',
            self::MandateSignatureInvalid => 'Signature invalide',
            self::MandateFeeInvalid => 'Honoraires invalides',
            self::MandateUnitNotAvailable => 'Lot indisponible',
            self::MandatePartyNotAvailable => 'Mandant indisponible',
            self::MandateTerminationInvalid => 'Résiliation invalide',
            self::MandateRenewalInvalid => 'Renouvellement invalide',
            self::OwnerAccessReadOnly => 'Accès en lecture seule',
            self::OwnerRoleForbidden => 'Action non permise pour ce rôle',
            self::OwnerAgencyNotFound => 'Agence introuvable',
            self::OwnerMandateNotFound => 'Mandat introuvable',
            self::OwnerUnitNotFound => 'Bien introuvable',
            self::OwnerDocumentNotFound => 'Document introuvable',
            self::MandateEndRequestNotFound => 'Demande de fin de mandat introuvable',
            self::MandateEndRequestNotPending => 'Demande de fin de mandat déjà traitée',
            self::MandateAmendmentSignatureRequired => 'Avenant sans pièce signée',
            self::MandateDocumentInvalid => 'Pièce non partageable',
            self::MandateDocumentNotFound => 'Pièce du mandat introuvable',
            self::MandateAmendmentDocumentLocked => 'Avenant non retirable',
            self::MandateTermDefaultsNotFound => 'Conditions par défaut non définies',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::MandateNotFound => 'Ce mandat n\'existe pas dans votre organisation.',
            self::MandateUnitNotFound => 'Ce lot n\'est pas rattaché à ce mandat.',
            self::MandateAgencyOnly => 'Les mandats de gestion sont réservés aux organisations de type agence.',
            self::MandateNotDraft => 'Seul un mandat en brouillon peut être modifié ainsi : il est déjà activé ou clos.',
            self::MandateNotRunning => 'Cette opération suppose un mandat actif ou suspendu.',
            self::MandateNotActive => 'Cette opération suppose un mandat actif.',
            self::MandateNotSuspended => 'Ce mandat n\'est pas suspendu.',
            self::MandateArchived => 'Un mandat archivé ne se modifie plus.',
            self::MandateNotArchivable => 'Un mandat actif ou suspendu ne s\'archive pas : résiliez-le d\'abord.',
            self::MandateStaleVersion => 'Ce mandat a été modifié par quelqu\'un d\'autre. Rechargez-le avant de recommencer.',
            self::MandateOverlap => 'Un autre mandat de votre agence couvre déjà ce lot sur cette période.',
            self::MandateUnitConflict => 'Ce lot est déjà rattaché à ce mandat sur cette période.',
            self::MandateLastUnit => 'Un mandat garde au moins un lot : résiliez le mandat pour le clore.',
            self::MandateTermConflict => 'De nouvelles conditions prennent effet après la date des conditions en cours.',
            self::MandatePeriodInvalid => 'Les dates du mandat sont incohérentes.',
            self::MandateNoUnit => 'Un mandat doit couvrir au moins un lot.',
            self::MandateSignatureInvalid => 'La date ou le fichier de signature est invalide.',
            self::MandateFeeInvalid => 'Les honoraires saisis sont incohérents : un taux ou un forfait, pas les deux.',
            self::MandateUnitNotAvailable => 'Ce lot est archivé : il ne peut plus être confié en mandat.',
            self::MandatePartyNotAvailable => 'Ce contact est anonymisé : il ne peut plus être mandant.',
            self::MandateTerminationInvalid => 'Les dates de préavis et de fin ne permettent pas la résiliation.',
            self::MandateRenewalInvalid => 'Ce mandat ne peut pas être renouvelé ainsi.',
            self::OwnerAccessReadOnly => 'Votre mandat est terminé : votre espace reste en lecture seule pendant 12 mois.',
            self::OwnerRoleForbidden => 'Votre rôle sur ce mandant est en lecture seule : seul le titulaire ou son représentant peut agir.',
            self::OwnerAgencyNotFound => 'Cette agence n\'est pas rattachée à votre compte.',
            self::OwnerMandateNotFound => 'Ce mandat n\'existe pas dans votre espace.',
            self::OwnerUnitNotFound => 'Ce bien n\'existe pas dans votre espace.',
            self::OwnerDocumentNotFound => 'Ce document n\'existe pas dans votre espace ou n\'est plus partagé.',
            self::MandateEndRequestNotFound => 'Aucune demande de fin de mandat en cours sur ce mandat.',
            self::MandateEndRequestNotPending => 'La dernière demande de fin de mandat est déjà annulée ou satisfaite : elle ne peut plus être rejetée.',
            self::MandateAmendmentSignatureRequired => 'Un avenant aux honoraires exige la pièce signée du mandant, téléversée pour ce mandat.',
            self::MandateDocumentInvalid => 'Seul un fichier téléversé pour ce mandat peut être partagé avec le mandant.',
            self::MandateDocumentNotFound => 'Cette pièce n\'existe pas sur ce mandat ou n\'est plus partagée.',
            self::MandateAmendmentDocumentLocked => 'La pièce signée d\'un avenant prouve les honoraires en vigueur : elle ne se retire pas du partage avec le mandant.',
            self::MandateTermDefaultsNotFound => 'Votre agence n\'a pas encore défini de conditions par défaut pour les nouveaux mandats.',
        };
    }
}
