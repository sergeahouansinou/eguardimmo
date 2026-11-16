<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\EndLeasePartyData;
use Illuminate\Foundation\Http\FormRequest;

final class EndLeasePartyRequest extends FormRequest
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'valid_to' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
        ];
    }

    public function toData(): EndLeasePartyData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new EndLeasePartyData(
            lockVersion: (int) $v['lock_version'],
            validTo: (string) $v['valid_to'],
        );
    }
}
