<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Parties\Data\NewPartyData;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\Support\PartyInput;
use App\Modules\Parties\Support\PartyRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreatePartyRequest extends FormRequest
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
            'kind' => ['required', Rule::enum(PartyKind::class)],
            'allow_duplicate' => ['boolean'],
            ...PartyRules::identity(),
            ...PartyRules::initialDetails(),
        ];
    }

    public function toData(): NewPartyData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return PartyInput::from($v, (bool) ($v['allow_duplicate'] ?? false));
    }
}
