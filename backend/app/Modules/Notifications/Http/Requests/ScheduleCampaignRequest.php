<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

final class ScheduleCampaignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return ['scheduled_at' => ['required', 'date']];
    }

    public function scheduledAt(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->string('scheduled_at'));
    }
}
