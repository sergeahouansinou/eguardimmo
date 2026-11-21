<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Data\NewConversationData;
use App\Modules\Messaging\Data\NewExternalConversationData;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Support\MessageInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StartConversationRequest extends FormRequest
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
        $externe = $this->kind()->isExternal();

        return [
            'kind' => ['nullable', Rule::enum(ConversationKind::class)],
            'recipient_id' => [$externe ? 'prohibited' : 'required', 'uuid'],
            'party_id' => [$externe ? 'required' : 'prohibited', 'uuid'],
            'lease_id' => [$this->kind() === ConversationKind::Tenant ? 'required' : 'prohibited', 'uuid'],
            'mandate_id' => [$this->kind() === ConversationKind::Owner ? 'nullable' : 'prohibited', 'uuid'],
            'subject' => ['required', 'string', 'max:140'],
            ...MessageInput::rules(),
            'client_id' => [$externe ? 'required' : 'nullable', 'uuid'],
        ];
    }

    public function toData(): NewConversationData
    {
        return new NewConversationData(
            strtolower((string) $this->string('recipient_id')),
            trim((string) $this->string('subject')),
            MessageInput::body($this),
            MessageInput::attachments($this),
            MessageInput::clientId($this),
        );
    }

    public function kind(): ConversationKind
    {
        return $this->filled('kind') && ConversationKind::tryFrom((string) $this->string('kind')) !== null
            ? ConversationKind::from((string) $this->string('kind'))
            : ConversationKind::Internal;
    }

    public function toExternalData(): NewExternalConversationData
    {
        return new NewExternalConversationData(
            $this->kind(),
            strtolower((string) $this->string('party_id')),
            $this->filled('lease_id') ? strtolower((string) $this->string('lease_id')) : null,
            $this->filled('mandate_id') ? strtolower((string) $this->string('mandate_id')) : null,
            trim((string) $this->string('subject')),
            MessageInput::body($this),
            MessageInput::attachments($this),
            MessageInput::clientId($this),
        );
    }
}
