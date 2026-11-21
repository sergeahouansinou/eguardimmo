<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Data\ActivityFilters;
use App\Modules\Organizations\Enums\ActivityType;
use App\Modules\Organizations\Enums\ErrorCode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filtres communs de la liste et de l'export du journal : période semi-ouverte `[from, to[` en jours de l'organisation.
 *
 * @phpstan-require-extends FormRequest
 */
trait ReadsActivityFilters
{
    private const int JOURS_MAX = 366;

    /**
     * @return array<string, list<mixed>>
     */
    public function filterRules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after:from'],
            'actor' => ['nullable', 'uuid'],
            'type' => ['nullable', Rule::enum(ActivityType::class)],
            'subject_type' => ['nullable', 'required_with:subject_id', Rule::in(array_keys(Relation::morphMap()))],
            'subject_id' => ['nullable', 'required_with:subject_type', 'uuid'],
        ];
    }

    public function hasEntity(): bool
    {
        return $this->filled('subject_type') && $this->filled('subject_id');
    }

    public function filters(int $parPage = 25): ActivityFilters
    {
        $fuseau = OrganizationContext::organization($this)->timezone;
        $debut = $this->filled('from') ? CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->validated('from'), $fuseau)?->utc() : null;
        $fin = $this->filled('to') ? CarbonImmutable::createFromFormat('!Y-m-d', (string) $this->validated('to'), $fuseau)?->utc() : null;

        if ($debut !== null && $fin !== null && $debut->diffInDays($fin) > self::JOURS_MAX) {
            throw ErrorCode::ActivityRangeTooWide->problem();
        }

        return new ActivityFilters(
            from: $debut ?? CarbonImmutable::createFromTimestampUTC(0),
            to: $fin,
            actorId: $this->filled('actor') ? (string) $this->validated('actor') : null,
            type: $this->filled('type') ? ActivityType::from((string) $this->validated('type')) : null,
            subjectType: $this->hasEntity() ? (string) $this->validated('subject_type') : null,
            subjectId: $this->hasEntity() ? (string) $this->validated('subject_id') : null,
            perPage: $parPage,
        );
    }
}
