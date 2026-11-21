<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case RequestNotFound = 'privacy_request_not_found';
    case RequestClosed = 'privacy_request_closed';
    case RequestExists = 'privacy_request_exists';
    case ExportExpired = 'privacy_export_expired';
    case IdentityNotVerified = 'privacy_identity_not_verified';
    case AccountRequired = 'privacy_account_required';
    case AlreadyExtended = 'privacy_already_extended';
    case ExportUnavailable = 'privacy_export_unavailable';
    case DeadlinePassed = 'privacy_deadline_passed';
    case ErasureRequiresApproval = 'privacy_erasure_requires_approval';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::RequestNotFound, self::ExportUnavailable => 404,
            self::RequestClosed, self::RequestExists, self::IdentityNotVerified, self::AccountRequired, self::AlreadyExtended, self::DeadlinePassed, self::ErasureRequiresApproval => 409,
            self::ExportExpired => 410,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::RequestNotFound => 'Demande introuvable',
            self::RequestClosed => 'Demande clôturée',
            self::RequestExists => 'Demande déjà en cours',
            self::ExportExpired => 'Export expiré',
            self::IdentityNotVerified => 'Identité non vérifiée',
            self::AccountRequired => 'Compte requis',
            self::AlreadyExtended => 'Délai déjà prolongé',
            self::ExportUnavailable => 'Export indisponible',
            self::DeadlinePassed => 'Échéance dépassée',
            self::ErasureRequiresApproval => 'Double validation requise',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::RequestNotFound => 'Cette demande n\'existe pas.',
            self::RequestClosed => 'Cette demande est clôturée : elle ne peut plus être modifiée.',
            self::RequestExists => 'Une demande de ce type est déjà en cours de traitement.',
            self::ExportExpired => 'Cet export n\'est plus disponible : la durée de téléchargement est dépassée. Déposez une nouvelle demande d\'accès.',
            self::IdentityNotVerified => 'L\'identité du demandeur doit être vérifiée avant cette action.',
            self::AccountRequired => 'Cette demande n\'est rattachée à aucun compte.',
            self::AlreadyExtended => 'Le délai de cette demande a déjà été prolongé.',
            self::ExportUnavailable => 'Aucun export n\'est disponible pour cette demande.',
            self::DeadlinePassed => 'L\'échéance initiale est dépassée : le délai ne peut plus être prolongé.',
            self::ErasureRequiresApproval => 'Une demande d\'effacement se clôt par une demande de double validation sur ce compte.',
        };
    }
}
