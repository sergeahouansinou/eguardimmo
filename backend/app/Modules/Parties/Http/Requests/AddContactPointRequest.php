<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Parties\Enums\ContactPointType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AddContactPointRequest extends FormRequest
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
            'type' => ['required', Rule::enum(ContactPointType::class)],
            'value' => ['required', 'string', 'max:254'],
            'label' => ['nullable', 'string', 'max:60'],
            'is_primary' => ['boolean'],
        ];
    }

    public function type(): ContactPointType
    {
        return ContactPointType::from((string) $this->validated('type'));
    }

    public function value(): string
    {
        return (string) $this->validated('value');
    }

    public function label(): ?string
    {
        return $this->filled('label') ? trim((string) $this->validated('label')) : null;
    }

    public function primary(): bool
    {
        return $this->boolean('is_primary');
    }
}
