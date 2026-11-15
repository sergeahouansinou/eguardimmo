<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Data\TicketFilters;
use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListTicketsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::enum(TicketStatus::class)],
            'priority' => ['nullable', Rule::enum(TicketPriority::class)],
            'assignee' => ['nullable', 'string', 'regex:/^(none|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function toData(): TicketFilters
    {
        $assigne = $this->filled('assignee') ? strtolower((string) $this->string('assignee')) : null;
        $recherche = trim((string) $this->string('search'));

        return new TicketFilters(
            $this->filled('status') ? TicketStatus::from((string) $this->string('status')) : null,
            $this->filled('priority') ? TicketPriority::from((string) $this->string('priority')) : null,
            $assigne === 'none' ? null : $assigne,
            $assigne === 'none',
            $recherche === '' ? null : $recherche,
            $this->integer('page', 1),
            $this->integer('per_page', 20),
        );
    }
}
