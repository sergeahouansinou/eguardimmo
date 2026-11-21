<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Enums\SupportAccessScope;
use App\Modules\Messaging\Support\SupportRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RequestSupportAccessRequest extends FormRequest
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
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'scopes' => ['required', 'array', 'min:1', 'max:'.count(SupportAccessScope::cases())],
            'scopes.*' => ['required', 'string', Rule::enum(SupportAccessScope::class)],
            'duration_hours' => ['nullable', 'integer'],
        ];
    }

    public function reason(): string
    {
        return trim((string) $this->string('reason'));
    }

    /**
     * @return list<SupportAccessScope>
     */
    public function scopes(): array
    {
        return array_values(array_map(fn (mixed $valeur): SupportAccessScope => SupportAccessScope::from((string) $valeur), (array) $this->input('scopes', [])));
    }

    public function hours(): int
    {
        return $this->filled('duration_hours') ? $this->integer('duration_hours') : SupportRules::ACCES_DUREE_DEFAUT_HEURES;
    }
}
