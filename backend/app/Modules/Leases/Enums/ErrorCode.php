<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case LeaseNotFound = 'lease_not_found';
    case LeaseUnitNotFound = 'lease_unit_not_found';
    case LeasePartyNotFound = 'lease_party_not_found';
    case LeaseTermNotFound = 'lease_term_not_found';
    case LeaseNotDraft = 'lease_not_draft';
    case LeaseNotSigned = 'lease_not_signed';
    case LeaseArchived = 'lease_archived';
    case LeaseAlreadyTerminated = 'lease_already_terminated';
    case LeaseStaleVersion = 'lease_stale_version';
    case LeaseOverlap = 'lease_overlap';
    case LeaseUnitConflict = 'lease_unit_conflict';
    case LeaseMainUnitConflict = 'lease_main_unit_conflict';
    case LeasePartyConflict = 'lease_party_conflict';
    case LeaseTermOverlap = 'lease_term_overlap';
    case LeaseLastTenant = 'lease_last_tenant';
    case LeasePeriodInvalid = 'lease_period_invalid';
    case LeaseNoMainUnit = 'lease_no_main_unit';
    case LeaseNoTenant = 'lease_no_tenant';
    case LeaseNoRent = 'lease_no_rent';
    case LeaseSignatureInvalid = 'lease_signature_invalid';
    case LeaseNoticeInvalid = 'lease_notice_invalid';
    case LeaseNoticeExists = 'lease_notice_exists';
    case LeaseRenewalNotAllowed = 'lease_renewal_not_allowed';
    case LeaseComponentInvalid = 'lease_component_invalid';
    case LeaseDepositOverCap = 'lease_deposit_over_cap';
    case LeaseUnitNotAvailable = 'lease_unit_not_available';
    case LeasePartyNotAvailable = 'lease_party_not_available';
    case LeaseNotArchivable = 'lease_not_archivable';
    case LeaseRevisionNotAllowed = 'lease_revision_not_allowed';
    case LeaseRevisionTooEarly = 'lease_revision_too_early';
    case LeaseTermNotIndexed = 'lease_term_not_indexed';
    case LeaseDepositLocked = 'lease_deposit_locked';
    case JurisdictionUnsupported = 'jurisdiction_unsupported';
    case OwnerLeaseNotFound = 'owner_lease_not_found';
    case LeaseDocumentNotFound = 'lease_document_not_found';
    case LeaseDocumentInvalid = 'lease_document_invalid';
    case NoticeRequestNotFound = 'notice_request_not_found';
    case LeaseNoticeNotAllowed = 'lease_notice_not_allowed';
    case NoticeRequestExists = 'notice_request_exists';
    case NoticeRequestLocked = 'notice_request_locked';
    case NoticeDepartureTooEarly = 'notice_departure_too_early';
    case NoticeReasonUnsupported = 'notice_reason_unsupported';
    case NoticeProofRequired = 'notice_proof_required';
    case LeaseJurisdictionUnsupported = 'lease_jurisdiction_unsupported';
    case InsuranceSubmissionNotFound = 'insurance_submission_not_found';
    case InsuranceSubmissionNotPending = 'insurance_submission_not_pending';
    case InsuranceSubmissionNotAllowed = 'insurance_submission_not_allowed';
    case InsurancePeriodInvalid = 'insurance_period_invalid';
    case InsuranceReminderTooSoon = 'insurance_reminder_too_soon';
    case IdempotencyKeyReused = 'idempotency_key_reused';
    case NoticeLetterUnavailable = 'notice_letter_unavailable';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::LeaseNotFound, self::LeaseUnitNotFound, self::LeasePartyNotFound, self::LeaseTermNotFound, self::OwnerLeaseNotFound,
            self::LeaseDocumentNotFound, self::NoticeRequestNotFound, self::InsuranceSubmissionNotFound => 404,
            self::InsuranceReminderTooSoon => 429,
            self::NoticeLetterUnavailable => 503,
            self::LeaseDocumentInvalid, self::NoticeDepartureTooEarly, self::NoticeReasonUnsupported, self::NoticeProofRequired,
            self::LeaseJurisdictionUnsupported, self::InsurancePeriodInvalid => 422,
            self::LeasePeriodInvalid, self::LeaseNoMainUnit, self::LeaseNoTenant, self::LeaseNoRent, self::LeaseSignatureInvalid,
            self::LeaseNoticeInvalid, self::LeaseComponentInvalid, self::LeaseDepositOverCap,
            self::LeaseUnitNotAvailable, self::LeasePartyNotAvailable, self::JurisdictionUnsupported => 422,
            default => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::LeaseNotFound, self::OwnerLeaseNotFound => 'Bail introuvable',
            self::LeaseUnitNotFound => 'Lot du bail introuvable',
            self::LeasePartyNotFound => 'Partie du bail introuvable',
            self::LeaseTermNotFound => 'Composante du bail introuvable',
            self::LeaseNotDraft => 'Bail déjà signé',
            self::LeaseNotSigned => 'Bail non signé',
            self::LeaseArchived => 'Bail archivé',
            self::LeaseAlreadyTerminated => 'Bail déjà terminé',
            self::LeaseStaleVersion => 'Bail modifié entre-temps',
            self::LeaseOverlap => 'Lot déjà loué sur la période',
            self::LeaseUnitConflict => 'Lot déjà rattaché au bail',
            self::LeaseMainUnitConflict => 'Lot principal déjà désigné',
            self::LeasePartyConflict => 'Partie déjà rattachée au bail',
            self::LeaseTermOverlap => 'Composante déjà définie sur la période',
            self::LeaseLastTenant => 'Dernier locataire du bail',
            self::LeasePeriodInvalid => 'Période invalide',
            self::LeaseNoMainUnit => 'Lot principal manquant',
            self::LeaseNoTenant => 'Locataire manquant',
            self::LeaseNoRent => 'Loyer manquant',
            self::LeaseSignatureInvalid => 'Signature invalide',
            self::LeaseNoticeInvalid => 'Préavis invalide',
            self::LeaseNoticeExists => 'Préavis déjà enregistré',
            self::LeaseRenewalNotAllowed => 'Renouvellement non permis',
            self::LeaseComponentInvalid => 'Composante invalide',
            self::LeaseDepositOverCap => 'Dépôt de garantie au-dessus du plafond',
            self::LeaseUnitNotAvailable => 'Lot indisponible',
            self::LeasePartyNotAvailable => 'Contact indisponible',
            self::LeaseNotArchivable => 'Bail non archivable',
            self::LeaseRevisionNotAllowed => 'Révision non permise par le régime',
            self::LeaseRevisionTooEarly => 'Révision trop précoce',
            self::LeaseTermNotIndexed => 'Composante non indexée',
            self::LeaseDepositLocked => 'Dépôt de garantie figé',
            self::JurisdictionUnsupported => 'Juridiction non prise en charge',
            self::LeaseDocumentNotFound => 'Pièce du bail introuvable',
            self::LeaseDocumentInvalid => 'Pièce invalide',
            self::NoticeRequestNotFound => 'Demande de congé introuvable',
            self::LeaseNoticeNotAllowed => 'Congé impossible',
            self::NoticeRequestExists => 'Demande de congé déjà ouverte',
            self::NoticeRequestLocked => 'Demande de congé figée',
            self::NoticeDepartureTooEarly => 'Date de départ trop proche',
            self::NoticeReasonUnsupported => 'Motif de préavis inconnu',
            self::NoticeProofRequired => 'Justificatif obligatoire',
            self::LeaseJurisdictionUnsupported => 'Juridiction du bail non prise en charge',
            self::InsuranceSubmissionNotFound => 'Dépôt d\'attestation introuvable',
            self::InsuranceSubmissionNotPending => 'Dépôt déjà traité',
            self::InsuranceSubmissionNotAllowed => 'Dépôt impossible',
            self::InsurancePeriodInvalid => 'Période d\'assurance invalide',
            self::InsuranceReminderTooSoon => 'Relance trop proche',
            self::NoticeLetterUnavailable => 'Lettre de congé indisponible',
            self::IdempotencyKeyReused => 'Clé d\'idempotence réutilisée',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::LeaseNotFound => 'Ce bail n\'existe pas dans votre organisation.',
            self::OwnerLeaseNotFound => 'Ce bail n\'existe pas dans votre espace.',
            self::LeaseUnitNotFound => 'Ce lot n\'est pas rattaché à ce bail.',
            self::LeasePartyNotFound => 'Cette partie n\'est pas rattachée à ce bail.',
            self::LeaseTermNotFound => 'Cette composante n\'existe pas pour ce bail.',
            self::LeaseNotDraft => 'Seul un bail en brouillon peut être modifié ainsi : le bail est signé ou clos.',
            self::LeaseNotSigned => 'Cette opération suppose un bail signé.',
            self::LeaseArchived => 'Un bail archivé ne se modifie plus.',
            self::LeaseAlreadyTerminated => 'Ce bail est déjà terminé ou annulé.',
            self::LeaseStaleVersion => 'Le bail a été modifié depuis sa lecture : rechargez-le avant de renvoyer vos changements.',
            self::LeaseOverlap => 'Un autre bail occupe déjà l\'un de ces lots pendant tout ou partie de cette période.',
            self::LeaseUnitConflict => 'Ce lot est déjà rattaché à ce bail sur cette période.',
            self::LeaseMainUnitConflict => 'Un bail n\'a qu\'un seul lot principal à la fois.',
            self::LeasePartyConflict => 'Cette partie tient déjà ce rôle dans le bail sur cette période.',
            self::LeaseTermOverlap => 'Cette composante est déjà définie sur tout ou partie de cette période : révisez-la plutôt.',
            self::LeaseLastTenant => 'Le dernier locataire ne peut pas quitter le bail : terminez le bail.',
            self::LeasePeriodInvalid => 'Les dates du bail ou de la période sont incohérentes : la fin doit suivre le début.',
            self::LeaseNoMainUnit => 'Désignez un lot principal avant de continuer.',
            self::LeaseNoTenant => 'Ajoutez au moins un locataire avant de continuer.',
            self::LeaseNoRent => 'Ajoutez une ligne de loyer en vigueur à la date de début du bail avant de continuer.',
            self::LeaseSignatureInvalid => 'La date de signature ou le fichier signé est invalide.',
            self::LeaseNoticeInvalid => 'Les dates ou l\'auteur du préavis sont incohérents avec le bail.',
            self::LeaseNoticeExists => 'Un préavis est déjà enregistré sur ce bail : demandez explicitement son remplacement.',
            self::LeaseRenewalNotAllowed => 'Ce bail ne peut pas être renouvelé dans ces conditions : régime, terme ou préavis en cours.',
            self::LeaseComponentInvalid => 'Cette valeur n\'est pas une composante du loyer de votre organisation.',
            self::LeaseDepositOverCap => 'Le dépôt de garantie dépasse le plafond légal du régime du bail.',
            self::LeaseUnitNotAvailable => 'Ce lot est archivé ou ne peut pas être loué selon la juridiction du bail.',
            self::LeasePartyNotAvailable => 'Ce contact est archivé ou anonymisé et ne peut plus être rattaché à un bail.',
            self::LeaseNotArchivable => 'Un bail signé en cours, ou résilié dont la fin n\'est pas encore atteinte, ne s\'archive pas.',
            self::LeaseRevisionNotAllowed => 'Le régime de ce bail ne prévoit pas de révision du loyer (bail sans révision ou logement classé F ou G).',
            self::LeaseRevisionTooEarly => 'La révision du loyer ne peut pas prendre effet avant la prochaine date de révision du bail.',
            self::LeaseTermNotIndexed => 'Seule une composante indexée peut faire l\'objet d\'une révision : utilisez un avenant ou une correction.',
            self::LeaseDepositLocked => 'Le dépôt de garantie ne se révise pas après la signature du bail.',
            self::JurisdictionUnsupported => 'Aucune règle de bail n\'est ouverte pour cette juridiction ou ce régime.',
            self::LeaseDocumentNotFound => 'Cette pièce n\'existe pas ou n\'est pas partagée avec vous.',
            self::LeaseDocumentInvalid => 'Le fichier ou la fiche désignée ne peut pas être partagé sur ce bail.',
            self::NoticeRequestNotFound => 'Cette demande de congé n\'existe pas.',
            self::LeaseNoticeNotAllowed => 'Le bail n\'est pas signé, est terminé, a déjà un préavis, ou l\'occupation est close.',
            self::NoticeRequestExists => 'Une demande de congé est déjà en cours pour ce bail et cette fiche.',
            self::NoticeRequestLocked => 'Cette demande a été accusée ou close : elle ne peut plus être retirée ou accusée.',
            self::NoticeDepartureTooEarly => 'La date de départ souhaitée précède la fin du préavis applicable.',
            self::NoticeReasonUnsupported => 'Ce motif ne figure pas parmi les motifs proposés pour ce bail.',
            self::NoticeProofRequired => 'Ce motif de préavis réduit exige un justificatif.',
            self::LeaseJurisdictionUnsupported => 'Aucune règle de préavis n\'est ouverte pour la juridiction de ce bail.',
            self::InsuranceSubmissionNotFound => 'Ce dépôt n\'existe pas.',
            self::InsuranceSubmissionNotPending => 'Ce dépôt a déjà été accepté, refusé ou retiré.',
            self::InsuranceSubmissionNotAllowed => 'Le dépôt d\'une attestation suppose un bail en cours.',
            self::InsurancePeriodInvalid => 'La fin de la période doit suivre son début et ne pas être déjà passée.',
            self::InsuranceReminderTooSoon => 'Une relance d\'assurance a déjà été envoyée pour ce bail ces 7 derniers jours.',
            self::NoticeLetterUnavailable => 'La lettre de congé n\'a pas pu être produite : rien n\'a été enregistré, réessayez dans quelques instants.',
            self::IdempotencyKeyReused => 'Cette clé a déjà servi pour une demande différente.',
        };
    }
}
