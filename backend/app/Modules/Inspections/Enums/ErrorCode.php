<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case InspectionNotFound = 'inspection_not_found';
    case InspectionRemarkNotFound = 'inspection_remark_not_found';
    case InspectionRemarkWindowClosed = 'inspection_remark_window_closed';
    case InspectionNotPublishable = 'inspection_not_publishable';
    case InspectionPublished = 'inspection_published';
    case InspectionStaleVersion = 'inspection_stale_version';
    case InspectionRemarkAnswered = 'inspection_remark_answered';
    case IdempotencyKeyReused = 'idempotency_key_reused';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::InspectionNotFound, self::InspectionRemarkNotFound => 404,
            default => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::InspectionNotFound => 'État des lieux introuvable',
            self::InspectionRemarkNotFound => 'Remarque introuvable',
            self::InspectionRemarkWindowClosed => 'Délai de remarque dépassé',
            self::InspectionNotPublishable => 'État des lieux non publiable',
            self::InspectionPublished => 'État des lieux déjà publié',
            self::InspectionStaleVersion => 'État des lieux modifié entre-temps',
            self::InspectionRemarkAnswered => 'Remarque déjà traitée',
            self::IdempotencyKeyReused => 'Clé d\'idempotence réutilisée',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::InspectionNotFound => 'Cet état des lieux n\'existe pas ou ne vous est pas accessible.',
            self::InspectionRemarkNotFound => 'Cette remarque n\'existe pas.',
            self::InspectionRemarkWindowClosed => 'Ce type de remarque n\'est plus possible pour cet état des lieux.',
            self::InspectionNotPublishable => 'Cet état des lieux ne peut pas être publié en l\'état.',
            self::InspectionPublished => 'Un état des lieux publié ne se modifie plus.',
            self::InspectionStaleVersion => 'L\'état des lieux a changé depuis votre lecture : rechargez-le.',
            self::InspectionRemarkAnswered => 'Cette remarque a déjà reçu une réponse.',
            self::IdempotencyKeyReused => 'Cette clé a déjà servi pour une demande différente.',
        };
    }
}
