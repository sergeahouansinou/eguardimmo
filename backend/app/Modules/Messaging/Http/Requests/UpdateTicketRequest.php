<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Data\TicketPatchData;
use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateTicketRequest extends FormRequest
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
            'status' => ['required_without_all:priority,assignee_id,read', Rule::enum(TicketStatus::class)],
            'priority' => ['sometimes', Rule::enum(TicketPriority::class)],
            'assignee_id' => ['sometimes', 'nullable', 'uuid'],
            'read' => ['sometimes', 'accepted'],
        ];
    }

    public function toData(): TicketPatchData
    {
        return new TicketPatchData(
            $this->has('status') ? TicketStatus::from((string) $this->string('status')) : null,
            $this->has('priority') ? TicketPriority::from((string) $this->string('priority')) : null,
            $this->exists('assignee_id'),
            $this->filled('assignee_id') ? strtolower((string) $this->string('assignee_id')) : null,
            $this->has('read'),
        );
    }
}
