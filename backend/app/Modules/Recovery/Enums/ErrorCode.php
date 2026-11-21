<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case CaseNotFound = 'recovery_case_not_found';
    case ItemNotFound = 'recovery_item_not_found';
    case BundleNotFound = 'recovery_bundle_not_found';
    case TransmissionNotFound = 'recovery_transmission_not_found';
    case LinkNotFound = 'recovery_link_not_found';
    case ReceivableInvalid = 'recovery_receivable_invalid';
    case ReceivableTaken = 'recovery_receivable_taken';
    case DebtorInvalid = 'recovery_debtor_invalid';
    case CaseExists = 'recovery_case_exists';
    case CaseNotActive = 'recovery_case_not_active';
    case CaseEmpty = 'recovery_case_empty';
    case NothingDue = 'recovery_nothing_due';
    case StatusTransitionInvalid = 'recovery_status_transition_invalid';
    case RecipientInvalid = 'recovery_recipient_invalid';
    case TransmissionNotActive = 'recovery_transmission_not_active';
    case PdfUnavailable = 'recovery_pdf_unavailable';
    case LinkUnavailable = 'recovery_link_unavailable';
    case BundleUnavailable = 'recovery_bundle_unavailable';
    case BundleConflict = 'recovery_bundle_conflict';

    private const RETRY_AFTER_SECONDES = 30;

    public function problem(?string $detail = null): ApiProblem
    {
        $entetes = $this === self::PdfUnavailable ? ['Retry-After' => (string) self::RETRY_AFTER_SECONDES] : [];

        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail(), $entetes);
    }

    public function status(): int
    {
        return match ($this) {
            self::CaseNotFound, self::ItemNotFound, self::BundleNotFound, self::TransmissionNotFound, self::LinkNotFound => 404,
            self::ReceivableInvalid, self::DebtorInvalid, self::RecipientInvalid => 422,
            self::PdfUnavailable, self::LinkUnavailable, self::BundleUnavailable => 503,
            self::ReceivableTaken, self::CaseExists, self::CaseNotActive, self::CaseEmpty, self::NothingDue, self::StatusTransitionInvalid, self::TransmissionNotActive, self::BundleConflict => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::CaseNotFound => 'Dossier de recouvrement introuvable',
            self::ItemNotFound => 'Créance introuvable dans le dossier',
            self::BundleNotFound => 'Envoi de pièces introuvable',
            self::TransmissionNotFound => 'Transmission introuvable',
            self::LinkNotFound => 'Lien introuvable',
            self::ReceivableInvalid => 'Créance non recouvrable',
            self::ReceivableTaken => 'Créance déjà en recouvrement',
            self::DebtorInvalid => 'Débiteur invalide',
            self::CaseExists => 'Dossier déjà ouvert',
            self::CaseNotActive => 'Dossier clos',
            self::CaseEmpty => 'Dossier sans créance',
            self::NothingDue => 'Plus rien à recouvrer',
            self::StatusTransitionInvalid => 'Changement de statut refusé',
            self::RecipientInvalid => 'Destinataire invalide',
            self::TransmissionNotActive => 'Transmission déjà révoquée',
            self::PdfUnavailable => 'Service PDF indisponible',
            self::LinkUnavailable => 'Lien de transmission indisponible',
            self::BundleUnavailable => 'Pièces indisponibles',
            self::BundleConflict => 'Génération concurrente',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::CaseNotFound => 'Ce dossier de recouvrement n\'existe pas dans votre organisation.',
            self::ItemNotFound => 'Cette créance n\'est pas dans ce dossier.',
            self::BundleNotFound => 'Cet envoi de pièces n\'existe pas dans votre organisation.',
            self::TransmissionNotFound => 'Cette transmission n\'existe pas dans votre organisation.',
            self::LinkNotFound => 'Ce lien est invalide, expiré ou révoqué.',
            self::ReceivableInvalid => 'Cette créance n\'est pas un impayé échu de ce bail.',
            self::ReceivableTaken => 'Cette créance est déjà dans un dossier de recouvrement ouvert.',
            self::DebtorInvalid => 'Le débiteur doit être un locataire de ce bail.',
            self::CaseExists => 'Un dossier ouvert existe déjà pour ce bail et ce débiteur.',
            self::CaseNotActive => 'Ce dossier est clos ou irrécouvrable : il n\'accepte plus de modification.',
            self::CaseEmpty => 'Le dossier ne contient aucune créance : ajoutez-en avant de générer un envoi.',
            self::NothingDue => 'Toutes les créances de ce dossier sont soldées au grand livre : il n\'y a plus rien à transmettre.',
            self::StatusTransitionInvalid => 'Ce changement de statut n\'est pas permis depuis le statut actuel du dossier.',
            self::RecipientInvalid => 'Le destinataire doit être un commissaire de justice de l\'organisation, actif et doté d\'une adresse e-mail.',
            self::TransmissionNotActive => 'Cette transmission est déjà révoquée.',
            self::PdfUnavailable => 'Le service de génération des PDF ne répond pas : réessayez dans un instant.',
            self::LinkUnavailable => 'L\'adresse https des liens de transmission n\'est pas configurée.',
            self::BundleUnavailable => 'Le contenu de cet envoi n\'est plus disponible.',
            self::BundleConflict => 'Une autre génération d\'envoi a eu lieu en même temps : réessayez.',
        };
    }
}
