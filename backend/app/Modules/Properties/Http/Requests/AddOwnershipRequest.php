<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use App\Modules\Properties\Data\NewOwnershipData;
use App\Modules\Properties\Enums\OwnershipNature;
use App\Modules\Properties\Support\OwnershipLoad;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AddOwnershipRequest extends FormRequest
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
            'party_id' => ['required', 'uuid'],
            'share_bp' => ['required', 'integer', 'between:1,'.OwnershipLoad::CAP],
            'nature' => ['required', Rule::enum(OwnershipNature::class)],
            'valid_from' => ['required', 'date_format:Y-m-d'],
            'valid_to' => ['nullable', 'date_format:Y-m-d', 'after:valid_from'],
        ];
    }

    public function toData(): NewOwnershipData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewOwnershipData(
            partyId: (string) $v['party_id'],
            shareBp: (int) $v['share_bp'],
            nature: OwnershipNature::from((string) $v['nature']),
            validFrom: (string) $v['valid_from'],
            validTo: isset($v['valid_to']) ? (string) $v['valid_to'] : null,
        );
    }
}
