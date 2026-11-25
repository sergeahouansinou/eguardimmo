<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests\Console;

use Illuminate\Foundation\Http\FormRequest;

final class SendPlatformCampaignRequest extends FormRequest
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
        return ['lock_version' => ['required', 'integer', 'min:1']];
    }

    public function lockVersion(): int
    {
        return $this->integer('lock_version');
    }
}
