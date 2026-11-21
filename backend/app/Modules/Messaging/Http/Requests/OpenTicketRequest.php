<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Data\NewTicketData;
use App\Modules\Messaging\Enums\RequesterSpace;
use App\Modules\Messaging\Enums\TicketCategory;
use App\Modules\Messaging\Support\MessageInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class OpenTicketRequest extends FormRequest
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
            'space' => ['required', Rule::enum(RequesterSpace::class)],
            'organization_id' => ['nullable', 'uuid', 'prohibited_unless:space,'.RequesterSpace::Organization->value, Rule::requiredIf(fn (): bool => $this->input('space') === RequesterSpace::Organization->value)],
            'category' => ['required', Rule::enum(TicketCategory::class)],
            'subject' => ['required', 'string', 'max:140'],
            ...MessageInput::rules(),
        ];
    }

    public function toData(): NewTicketData
    {
        return new NewTicketData(
            RequesterSpace::from((string) $this->string('space')),
            $this->filled('organization_id') ? strtolower((string) $this->string('organization_id')) : null,
            TicketCategory::from((string) $this->string('category')),
            trim((string) $this->string('subject')),
            MessageInput::body($this),
            MessageInput::attachments($this),
            MessageInput::clientId($this),
        );
    }
}
