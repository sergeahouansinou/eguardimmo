<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

final class AcknowledgeNoticeRequestRequest extends FormRequest
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
        return ['received_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01']];
    }

    public function receivedOn(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->validated('received_on'))->startOfDay();
    }
}
