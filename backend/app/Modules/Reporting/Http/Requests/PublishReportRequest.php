<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

final class PublishReportRequest extends FormRequest
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
        return ['scheduled_for' => ['sometimes', 'date', 'after:now']];
    }

    public function scheduledFor(): ?CarbonImmutable
    {
        $date = $this->validated('scheduled_for');

        return is_string($date) ? CarbonImmutable::parse($date) : null;
    }
}
