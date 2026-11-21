<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\UpdateMandateTermDefaultsData;
use App\Modules\Mandates\Http\Support\MandateInput;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateMandateTermDefaultsRequest extends FormRequest
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
            'lock_version' => ['nullable', 'integer', 'min:1'],
            ...MandateInput::termRules(''),
        ];
    }

    public function toData(): UpdateMandateTermDefaultsData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new UpdateMandateTermDefaultsData(
            isset($v['lock_version']) ? (int) $v['lock_version'] : null,
            MandateInput::termsFrom($v),
        );
    }
}
