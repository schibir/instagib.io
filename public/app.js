
$(document).ready(function()
{
    $('#nickname').on('input',function(e)
    {
        $("#nick-form").removeClass('has-error');
    });

    $('#nick-form').submit(function(e)
    {
        $('#nick-form').hide();
        $('#loading').show();
        e.preventDefault();
        var nick = $('#nickname').val();
        if (nick === "" || nick.length > 10)
        {
            $("#nick-form").addClass('has-error');
        }
        else
        {
            $.ajax(
            {
                url: '/login',
                type: 'post',
                dataType: 'json',
                data:
                {
                    nick : nick
                },
                statusCode:
                {
                    200: function(res)
                    {
                        location.href = res.responseText;
                    }
                }
            });
        }
    });
});