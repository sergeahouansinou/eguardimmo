<?php

declare(strict_types=1);

namespace App\Modules\Operations\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case ApprovalNotFound = 'approval_not_found';
    case ApprovalSelfForbidden = 'approval_self_forbidden';
    case ApprovalRoleForbidden = 'approval_role_forbidden';
    case ApprovalNotPending = 'approval_not_pending';
    case ApprovalExpired = 'approval_expired';
    case ApprovalPendingExists = 'approval_pending_exists';
    case ApprovalStale = 'approval_stale';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::ApprovalNotFound => 404,
            self::ApprovalSelfForbidden, self::ApprovalRoleForbidden => 403,
            self::ApprovalNotPending, self::ApprovalExpired, self::ApprovalPendingExists, self::ApprovalStale => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::ApprovalNotFound => 'Demande introuvable',
            self::ApprovalSelfForbidden => 'Validation de sa propre demande',
            self::ApprovalRoleForbidden => 'Rôle non habilité',
            self::ApprovalNotPending => 'Demande déjà traitée',
            self::ApprovalExpired => 'Demande expirée',
            self::ApprovalPendingExists => 'Demande déjà en attente',
            self::ApprovalStale => 'Situation modifiée',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::ApprovalNotFound => 'Cette demande n\'existe pas ou ne vous est pas accessible.',
            self::ApprovalSelfForbidden => 'Un opérateur ne peut pas valider ni rejeter sa propre demande : un second opérateur doit la traiter.',
            self::ApprovalRoleForbidden => 'Votre rôle d\'opérateur ne permet pas cette opération sur cette demande.',
            self::ApprovalNotPending => 'Cette demande n\'est plus en attente.',
            self::ApprovalExpired => 'Cette demande a expiré : déposez-en une nouvelle.',
            self::ApprovalPendingExists => 'Une demande est déjà en attente pour cette action sur ce sujet.',
            self::ApprovalStale => 'La situation a changé depuis la demande : rien n\'a été modifié. Déposez une nouvelle demande si l\'action reste utile.',
        };
    }
}
