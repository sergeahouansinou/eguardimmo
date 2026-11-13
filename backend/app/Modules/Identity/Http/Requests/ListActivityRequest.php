<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Data\ActivityFilters;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListActivityRequest extends FormRequest
{
    use PaginatesWithCursor;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...$this->paginationRules(['occurred_at' => 'date', 'id' => 'uuid']),
            'actor' => ['nullable', 'uuid'],
            'subject_type' => ['nullable', 'required_with:subject_id', Rule::in(array_keys(Relation::morphMap()))],
            'subject_id' => ['nullable', 'uuid'],
            'action' => ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9_.]+$/'],
            'organization' => ['nullable', 'uuid'],
            'request_id' => ['nullable', 'uuid'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after:from'],
        ];
    }

    public function toData(): ActivityFilters
    {
        return new ActivityFilters(
            actorId: $this->texte('actor'),
            subjectType: $this->texte('subject_type'),
            subjectId: $this->texte('subject_id'),
            actionPrefix: $this->texte('action'),
            organizationId: $this->texte('organization'),
            requestId: $this->texte('request_id'),
            from: $this->filled('from') ? $this->date('from')?->toImmutable() : null,
            to: $this->filled('to') ? $this->date('to')?->toImmutable() : null,
            perPage: $this->perPage(),
        );
    }

    private function texte(string $cle): ?string
    {
        return $this->filled($cle) ? strtolower((string) $this->string($cle)) : null;
    }
}
