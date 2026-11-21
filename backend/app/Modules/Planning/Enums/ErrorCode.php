<?php

declare(strict_types=1);

namespace App\Modules\Planning\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case EventNotFound = 'planning_event_not_found';
    case TaskNotFound = 'planning_task_not_found';
    case LinkInvalid = 'planning_link_invalid';
    case AssigneeInvalid = 'planning_assignee_invalid';
    case RangeTooWide = 'planning_range_too_wide';
    case BulkTooLarge = 'planning_bulk_too_large';
    case TaskNotOpen = 'planning_task_not_open';
    case VersionConflict = 'planning_version_conflict';
    case EventCancelled = 'planning_event_cancelled';
    case SeriesLimitReached = 'planning_series_limit_reached';
    case IdempotencyKeyReused = 'idempotency_key_reused';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::EventNotFound, self::TaskNotFound => 404,
            self::LinkInvalid, self::AssigneeInvalid, self::RangeTooWide, self::BulkTooLarge, self::SeriesLimitReached => 422,
            self::TaskNotOpen, self::VersionConflict, self::EventCancelled, self::IdempotencyKeyReused => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::EventNotFound => 'Événement introuvable',
            self::TaskNotFound => 'Tâche introuvable',
            self::LinkInvalid => 'Lien invalide',
            self::AssigneeInvalid => 'Responsable invalide',
            self::RangeTooWide => 'Période trop large',
            self::BulkTooLarge => 'Trop de tâches',
            self::TaskNotOpen => 'Tâche déjà clôturée',
            self::VersionConflict => 'Modifié entre-temps',
            self::EventCancelled => 'Événement annulé',
            self::SeriesLimitReached => 'Trop de séries récurrentes',
            self::IdempotencyKeyReused => 'Clé d\'idempotence réutilisée',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::EventNotFound => 'Cet événement n\'existe pas dans votre organisation.',
            self::TaskNotFound => 'Cette tâche n\'existe pas dans votre organisation.',
            self::LinkInvalid => 'Le bien, le lot ou le bail indiqué n\'existe pas dans votre organisation, ou ne correspond pas aux autres liens.',
            self::AssigneeInvalid => 'Le responsable doit être un membre actif de votre organisation.',
            self::RangeTooWide => 'La période demandée dépasse 62 jours ou contient plus de 500 occurrences : réduisez-la.',
            self::BulkTooLarge => 'Une action groupée porte sur 100 tâches au plus.',
            self::TaskNotOpen => 'Cette tâche est déjà terminée ou annulée : rouvrez-la d\'abord.',
            self::VersionConflict => 'L\'élément a été modifié depuis sa lecture : rechargez-le avant de renvoyer vos changements.',
            self::EventCancelled => 'Un événement annulé ne se modifie plus.',
            self::SeriesLimitReached => 'Le nombre de séries récurrentes actives de l\'organisation est atteint : annulez ou terminez une série avant d\'en ajouter une.',
            self::IdempotencyKeyReused => 'Cette clé a déjà servi pour une demande différente.',
        };
    }
}
