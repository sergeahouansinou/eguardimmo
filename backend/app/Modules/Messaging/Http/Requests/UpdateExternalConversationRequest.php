<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Enums\ConversationStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateExternalConversationRequest extends FormRequest
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
            'read' => [$this->hasAny(['archived', 'status', 'assignee_id']) ? 'sometimes' : 'required', 'boolean'],
            'archived' => ['boolean'],
            'status' => ['string', Rule::enum(ConversationStatus::class)],
            'assignee_id' => ['nullable', 'uuid'],
        ];
    }

    public function read(): ?bool
    {
        return $this->has('read') ? $this->boolean('read') : null;
    }

    public function archived(): ?bool
    {
        return $this->has('archived') ? $this->boolean('archived') : null;
    }

    public function status(): ?ConversationStatus
    {
        return $this->has('status') ? ConversationStatus::from((string) $this->string('status')) : null;
    }

    public function assigns(): bool
    {
        return $this->has('assignee_id');
    }

    public function assigneeId(): ?string
    {
        return $this->filled('assignee_id') ? strtolower((string) $this->string('assignee_id')) : null;
    }
}
